import {
    Alert, AlertIcon, Box, Button, Input, List, ListItem, Table, Tbody, Td, Text, Th, Thead, Tr, VStack,
} from '@chakra-ui/react';
import { useState } from 'react';
import { MdFileDownload } from 'react-icons/md';
import { toast } from 'react-toastify';
import { apiPost } from 'services/crm';
import { downloadFile, parseCSV, rowsToRecords, toCSV } from 'utils/csv';
import FormModal from './FormModal';

const MAX_ROWS = 5000;

// Import of a CSV file (Excel: File > Save as > CSV UTF-8). The columns are
// recognised by their Vietnamese or English headers, see `fields`:
// [{ key, label, aliases, example, transform: (text) => value }]
export default function ImportModal({ isOpen, onClose, title, fields, endpoint, templateName, onImported }) {
    const [fileName, setFileName] = useState('');
    const [records, setRecords] = useState([]);
    const [recognised, setRecognised] = useState([]);
    const [result, setResult] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const reset = () => {
        setFileName('');
        setRecords([]);
        setRecognised([]);
        setResult(null);
        setError('');
    };

    const close = () => {
        reset();
        onClose();
    };

    const downloadTemplate = () => {
        const columns = fields.map((field) => ({ header: field.label, value: () => field.example ?? '' }));
        downloadFile(`${templateName}.csv`, toCSV([{}], columns));
    };

    const readFile = async (file) => {
        reset();
        if (!file) return;
        setFileName(file.name);
        if (!/\.(csv|txt)$/i.test(file.name)) {
            setError('Chỉ nhận file CSV. Trong Excel chọn File > Save As > "CSV UTF-8 (Comma delimited)".');
            return;
        }
        const text = await file.text();
        const { records: rows, columns } = rowsToRecords(parseCSV(text), fields);
        const found = fields.filter((field) => columns.includes(field.key));
        if (!found.length) {
            setError('Không nhận ra cột nào. Hãy dùng file mẫu (dòng đầu là tên cột).');
            return;
        }
        if (rows.length > MAX_ROWS) {
            setError(`File có ${rows.length} dòng, tối đa ${MAX_ROWS} dòng mỗi lần nhập.`);
            return;
        }
        const transformed = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
            const field = fields.find((f) => f.key === key);
            return [key, field?.transform ? field.transform(value) : value];
        })));
        setRecognised(found);
        setRecords(transformed);
    };

    const submit = async () => {
        setIsSubmitting(true);
        try {
            const response = await apiPost(endpoint, records);
            setResult(response);
            if (response.inserted) {
                toast.success(`Đã nhập ${response.inserted} dòng`);
                onImported?.();
            }
        } catch (e) {
            toast.error(e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <FormModal
            isOpen={isOpen}
            onClose={close}
            title={title}
            size="4xl"
            onSubmit={!result && records.length ? submit : undefined}
            isSubmitting={isSubmitting}
            submitLabel={`Nhập ${records.length} dòng`}
            footer={<Button leftIcon={<MdFileDownload />} variant="outline" mr="auto" onClick={downloadTemplate}>Tải file mẫu</Button>}
        >
            <VStack align="stretch" spacing={4}>
                <Text fontSize="sm" color="gray.600">
                    Chọn file CSV (Excel: File &gt; Save As &gt; CSV UTF-8). Dòng đầu tiên là tên cột, ví dụ: {fields.slice(0, 4).map((f) => `"${f.label}"`).join(', ')}.
                    Các số điện thoại đã có trong hệ thống sẽ được bỏ qua.
                </Text>
                <Input type="file" accept=".csv,text/csv" p={1} onChange={(e) => readFile(e.target.files?.[0])} key={fileName || 'empty'} />
                {error && <Alert status="error" borderRadius="md"><AlertIcon />{error}</Alert>}

                {records.length > 0 && !result && (
                    <Box>
                        <Text fontSize="sm" mb={2}>
                            <b>{records.length}</b> dòng, các cột nhận được: {recognised.map((f) => f.label).join(', ')}
                        </Text>
                        <Box overflowX="auto" borderWidth="1px" borderRadius="md">
                            <Table size="sm">
                                <Thead>
                                    <Tr>{recognised.map((field) => <Th key={field.key} textTransform="none">{field.label}</Th>)}</Tr>
                                </Thead>
                                <Tbody>
                                    {records.slice(0, 5).map((record, index) => (
                                        <Tr key={index}>{recognised.map((field) => <Td key={field.key}>{String(record[field.key] ?? '')}</Td>)}</Tr>
                                    ))}
                                </Tbody>
                            </Table>
                        </Box>
                        {records.length > 5 && <Text fontSize="xs" color="gray.500" mt={1}>... và {records.length - 5} dòng khác</Text>}
                    </Box>
                )}

                {result && (
                    <Box>
                        <Alert status={result.inserted ? 'success' : 'warning'} borderRadius="md" mb={3}>
                            <AlertIcon />
                            Đã nhập {result.inserted} dòng{result.skipped?.length ? `, bỏ qua ${result.skipped.length} dòng` : ''}.
                        </Alert>
                        {result.skipped?.length > 0 && (
                            <List spacing={1} maxH="240px" overflowY="auto" fontSize="sm">
                                {result.skipped.map((skip) => (
                                    <ListItem key={skip.row}>
                                        Dòng {skip.row + 1}{skip.phone ? ` (${skip.phone})` : ''}: {skip.reason}
                                        {skip.duplicateOfRow ? ` (dòng ${skip.duplicateOfRow + 1})` : ''}
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Box>
                )}
            </VStack>
        </FormModal>
    );
}
