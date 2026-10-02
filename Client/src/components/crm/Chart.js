import { Flex, Text } from '@chakra-ui/react';
import vi from 'apexcharts/dist/locales/vi.json';
import ReactApexChart from 'react-apexcharts';

// Axis of counts (deals, customers): whole numbers only, never "0,5 khách"
export const countAxis = (values = []) => {
    const max = Math.max(1, ...values.map((value) => Number(value) || 0));
    const step = Math.max(1, Math.ceil(max / 5));
    return { min: 0, max: Math.ceil(max / step) * step, tickAmount: Math.ceil(max / step), labels: { formatter: (value) => String(Math.round(value)) } };
};

// Enough distinct colors for the sources of customers (the default palette has 5)
const PALETTE = ['#422AFB', '#01B574', '#FFB547', '#EE5D50', '#7551FF', '#39B8FF', '#FF7EB3', '#8D6E63', '#00A3A3', '#A3AED0'];

// ApexCharts with the Vietnamese locale. Never give a chart an `id`: with
// apexcharts >= 3.49.1 charts registered by id make other charts crash
// ("Maximum call stack size exceeded").
export default function Chart({ type, series, options = {}, height = 300, empty = false, emptyText = 'Chưa có dữ liệu' }) {
    if (empty) {
        return <Flex h={`${height}px`} align="center" justify="center"><Text color="gray.500">{emptyText}</Text></Flex>;
    }
    const chart = { toolbar: { show: false }, fontFamily: 'inherit', locales: [vi], defaultLocale: 'vi', ...(options.chart || {}) };
    return <ReactApexChart type={type} series={series} options={{ colors: PALETTE, ...options, chart }} height={height} width="100%" />;
}
