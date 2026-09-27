import {
    Box, Button, Checkbox, Flex, HStack, Icon, IconButton, Input, InputGroup, InputLeftElement, Select, Spinner, Stack,
    Table, Tbody, Td, Text, Th, Thead, Tr, useBreakpointValue, useColorModeValue, Wrap, WrapItem,
} from '@chakra-ui/react';
import Card from 'components/card/Card';
import { useEffect, useMemo, useState } from 'react';
import { FaSort, FaSortDown, FaSortUp } from 'react-icons/fa';
import { MdChevronLeft, MdChevronRight, MdDelete, MdFileDownload, MdSearch } from 'react-icons/md';
import { usePagination, useSortBy, useTable } from 'react-table';
import { downloadFile, toCSV } from 'utils/csv';
import { searchText } from 'utils/format';

const PAGE_SIZES = [10, 20, 50, 100];

const valueAt = (row, accessor) => {
    if (typeof accessor === 'function') return accessor(row);
    if (typeof accessor !== 'string') return undefined;
    return accessor.split('.').reduce((value, key) => (value === undefined || value === null ? value : value[key]), row);
};

// Vietnamese alphabetical order, numbers and dates in their natural order
const compareValues = (rowA, rowB, columnId) => {
    const a = rowA.values[columnId];
    const b = rowB.values[columnId];
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (a === undefined || a === null || a === '') return b === undefined || b === null || b === '' ? 0 : -1;
    if (b === undefined || b === null || b === '') return 1;
    return String(a).localeCompare(String(b), 'vi', { numeric: true, sensitivity: 'base' });
};

// List of records: search ignoring accents, filters, sorting, pagination,
// selection with bulk delete, CSV export, and cards instead of the table on
// phones (renderCard).
//
// columns: react-table columns ({ Header, accessor, Cell, disableSortBy }) plus
//   csv: (row) => value exported (false to skip), searchable: false,
//   hideOnMobile (when there is no card view)
// exportColumns: columns of the CSV file when they differ from the table
// filters: [{ id, label, options: [{ value, label }], getValue: (row) => value }]
export default function DataTable({
    title, columns, data, isLoading = false, toolbar, filters = [], searchPlaceholder = 'Tìm kiếm...',
    getSearchText, selectable = false, onDeleteSelected, renderCard, exportFileName, exportColumns,
    emptyText = 'Chưa có dữ liệu', initialSortBy = [], initialPageSize = 10, card = true,
}) {
    const [query, setQuery] = useState('');
    const [filterValues, setFilterValues] = useState({});
    const [selected, setSelected] = useState([]);
    const isMobile = useBreakpointValue({ base: true, md: false });
    const headerColor = useColorModeValue('gray.500', 'gray.400');
    const borderColor = useColorModeValue('gray.100', 'whiteAlpha.100');
    const rowHover = useColorModeValue('gray.50', 'whiteAlpha.50');
    const cardBg = useColorModeValue('white', 'navy.700');

    const rows = useMemo(() => {
        const words = searchText(query).split(' ').filter(Boolean);
        return (data || []).filter((row) => {
            const filtered = filters.some((filter) => {
                const wanted = filterValues[filter.id];
                if (!wanted) return false;
                const value = filter.getValue ? filter.getValue(row) : row[filter.id];
                return Array.isArray(value) ? !value.map(String).includes(wanted) : String(value ?? '') !== wanted;
            });
            if (filtered) return false;
            if (!words.length) return true;
            const text = searchText(getSearchText
                ? getSearchText(row)
                : columns.filter((column) => column.searchable !== false).map((column) => valueAt(row, column.accessor)).filter((value) => value !== undefined && value !== null && typeof value !== 'object').join(' '));
            return words.every((word) => text.includes(word));
        });
    }, [data, query, filterValues, filters, getSearchText, columns]);

    const tableColumns = useMemo(() => columns.map((column) => ({ sortType: compareValues, ...column })), [columns]);

    const {
        getTableProps, getTableBodyProps, headerGroups, prepareRow, page, canPreviousPage, canNextPage,
        pageCount, gotoPage, nextPage, previousPage, setPageSize, state: { pageIndex, pageSize },
    } = useTable(
        {
            columns: tableColumns,
            data: rows,
            getRowId: (row, index) => row._id || String(index),
            initialState: { pageIndex: 0, pageSize: initialPageSize, sortBy: initialSortBy },
            autoResetPage: false,
            autoResetSortBy: false,
        },
        useSortBy,
        usePagination,
    );

    // Back to the first page for a new search, stay on a valid page when rows go away
    useEffect(() => { gotoPage(0); }, [query, filterValues, gotoPage]);
    useEffect(() => {
        if (pageIndex > 0 && pageIndex >= pageCount) gotoPage(Math.max(0, pageCount - 1));
    }, [pageIndex, pageCount, gotoPage]);
    // Forget the selection of rows which are not listed any more
    useEffect(() => {
        setSelected((ids) => {
            const kept = ids.filter((id) => (data || []).some((row) => row._id === id));
            return kept.length === ids.length ? ids : kept;
        });
    }, [data]);

    const pageIds = page.map((row) => row.original._id).filter(Boolean);
    const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
    const toggle = (id) => setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    const togglePage = () => setSelected((ids) => (allOnPageSelected ? ids.filter((id) => !pageIds.includes(id)) : [...new Set([...ids, ...pageIds])]));

    const exportRows = () => {
        const exported = (exportColumns || columns)
            .filter((column) => column.csv !== false && (column.csv || column.accessor))
            .map((column) => ({
                header: column.csvHeader || (typeof column.Header === 'string' ? column.Header : column.id || ''),
                value: (row) => {
                    const value = column.csv ? column.csv(row) : valueAt(row, column.accessor);
                    return value !== null && typeof value === 'object' ? '' : value;
                },
            }));
        const date = new Date();
        const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
        downloadFile(`${exportFileName}-${stamp}.csv`, toCSV(rows, exported));
    };

    const showCards = Boolean(isMobile && renderCard);
    const from = rows.length ? pageIndex * pageSize + 1 : 0;
    const to = Math.min(rows.length, (pageIndex + 1) * pageSize);

    const content = (
        <>
            <Flex px={{ base: 0, md: 1 }} mb={4} gap={3} direction={{ base: 'column', lg: 'row' }} align={{ base: 'stretch', lg: 'center' }} justify="space-between">
                {title && (
                    <Text fontSize={{ base: 'lg', md: '22px' }} fontWeight="700" lineHeight="100%" whiteSpace="nowrap">
                        {title} <Text as="span" color="gray.400" fontWeight="600">({rows.length})</Text>
                    </Text>
                )}
                <Wrap spacing={2} justify={{ base: 'flex-start', lg: 'flex-end' }} align="center">
                    <WrapItem flex={{ base: '1 1 100%', md: '0 1 auto' }}>
                        <InputGroup size="md" minW={{ md: '240px' }}>
                            <InputLeftElement pointerEvents="none"><Icon as={MdSearch} color="gray.400" /></InputLeftElement>
                            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} borderRadius="10px" />
                        </InputGroup>
                    </WrapItem>
                    {filters.map((filter) => (
                        <WrapItem key={filter.id} flex={{ base: '1 1 45%', md: '0 1 auto' }}>
                            <Select
                                value={filterValues[filter.id] || ''}
                                onChange={(e) => setFilterValues((values) => ({ ...values, [filter.id]: e.target.value }))}
                                borderRadius="10px"
                                minW={{ md: '150px' }}
                                aria-label={filter.label}
                            >
                                <option value="">{filter.label}</option>
                                {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </Select>
                        </WrapItem>
                    ))}
                    {selectable && selected.length > 0 && onDeleteSelected && (
                        <WrapItem>
                            <Button leftIcon={<MdDelete />} colorScheme="red" variant="outline" onClick={() => onDeleteSelected(selected, () => setSelected([]))}>
                                Xóa ({selected.length})
                            </Button>
                        </WrapItem>
                    )}
                    {exportFileName && (
                        <WrapItem>
                            <Button leftIcon={<MdFileDownload />} variant="outline" onClick={exportRows} isDisabled={!rows.length}>
                                Xuất Excel
                            </Button>
                        </WrapItem>
                    )}
                    {toolbar && <WrapItem>{toolbar}</WrapItem>}
                </Wrap>
            </Flex>

            {isLoading ? (
                <Flex justify="center" py={10}><Spinner /></Flex>
            ) : rows.length === 0 ? (
                <Text textAlign="center" color="gray.500" py={10}>{(data || []).length && (query || Object.values(filterValues).some(Boolean)) ? 'Không tìm thấy kết quả phù hợp' : emptyText}</Text>
            ) : showCards ? (
                <Stack spacing={3}>
                    {page.map((row) => (
                        <Box key={row.id} borderWidth="1px" borderColor={borderColor} borderRadius="12px" p={3} bg={cardBg}>
                            {renderCard(row.original)}
                        </Box>
                    ))}
                </Stack>
            ) : (
                <Box overflowX="auto">
                    <Table {...getTableProps()} variant="simple" size="sm">
                        <Thead>
                            {headerGroups.map((headerGroup) => (
                                <Tr {...headerGroup.getHeaderGroupProps()}>
                                    {selectable && (
                                        <Th borderColor={borderColor} w="40px" px={2}>
                                            <Checkbox isChecked={allOnPageSelected} onChange={togglePage} aria-label="Chọn cả trang" />
                                        </Th>
                                    )}
                                    {headerGroup.headers.map((column) => (
                                        <Th
                                            {...column.getHeaderProps(column.canSort ? column.getSortByToggleProps({ title: undefined }) : undefined)}
                                            borderColor={borderColor}
                                            color={headerColor}
                                            fontSize="xs"
                                            textTransform="none"
                                            whiteSpace="nowrap"
                                            py={3}
                                            display={column.hideOnMobile ? { base: 'none', md: 'table-cell' } : undefined}
                                        >
                                            <Flex align="center" gap={1} justify={column.isNumeric ? 'flex-end' : 'flex-start'}>
                                                {column.render('Header')}
                                                {column.canSort && (
                                                    <Icon as={column.isSorted ? (column.isSortedDesc ? FaSortDown : FaSortUp) : FaSort} color={column.isSorted ? 'brand.500' : 'gray.300'} boxSize={3} />
                                                )}
                                            </Flex>
                                        </Th>
                                    ))}
                                </Tr>
                            ))}
                        </Thead>
                        <Tbody {...getTableBodyProps()}>
                            {page.map((row) => {
                                prepareRow(row);
                                const id = row.original._id;
                                return (
                                    <Tr {...row.getRowProps()} _hover={{ bg: rowHover }}>
                                        {selectable && (
                                            <Td borderColor={borderColor} px={2}>
                                                {id && <Checkbox isChecked={selected.includes(id)} onChange={() => toggle(id)} aria-label="Chọn" />}
                                            </Td>
                                        )}
                                        {row.cells.map((cell) => (
                                            <Td
                                                {...cell.getCellProps()}
                                                borderColor={borderColor}
                                                fontSize="sm"
                                                py={2.5}
                                                isNumeric={cell.column.isNumeric}
                                                display={cell.column.hideOnMobile ? { base: 'none', md: 'table-cell' } : undefined}
                                            >
                                                {cell.render('Cell')}
                                            </Td>
                                        ))}
                                    </Tr>
                                );
                            })}
                        </Tbody>
                    </Table>
                </Box>
            )}

            {!isLoading && rows.length > 0 && (
                <Flex mt={4} gap={3} align="center" justify="space-between" direction={{ base: 'column', sm: 'row' }}>
                    <Text fontSize="sm" color="gray.500">Hiển thị {from}–{to} / {rows.length}</Text>
                    <HStack spacing={2}>
                        <Select size="sm" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} w="auto" borderRadius="8px" aria-label="Số dòng mỗi trang" display={{ base: 'none', sm: 'block' }}>
                            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} / trang</option>)}
                        </Select>
                        <IconButton size="sm" icon={<MdChevronLeft />} onClick={previousPage} isDisabled={!canPreviousPage} aria-label="Trang trước" />
                        <Text fontSize="sm" whiteSpace="nowrap">Trang {pageIndex + 1}/{Math.max(pageCount, 1)}</Text>
                        <IconButton size="sm" icon={<MdChevronRight />} onClick={nextPage} isDisabled={!canNextPage} aria-label="Trang sau" />
                    </HStack>
                </Flex>
            )}
        </>
    );

    return card ? <Card px={{ base: 3, md: 5 }} py={{ base: 4, md: 5 }}>{content}</Card> : <Box>{content}</Box>;
}
