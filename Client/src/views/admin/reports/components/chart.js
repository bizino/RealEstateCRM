import { Grid, Text } from '@chakra-ui/react';
import Card from "components/card/Card";
import ReactApexChart from "react-apexcharts";


const ReportChart = (props) => {
    const { labels = [], series = [] } = props;
    const hasData = series.some((value) => value > 0);

    const options = {
        labels,
        dataLabels: {
            enabled: false,
        },
        responsive: [
            {
                breakpoint: 480,
                options: {
                    legend: {
                        show: false,
                    },
                },
            },
        ],
        legend: {
            position: "bottom",
        },
    };
    return (
        <Card>
            <Grid py={5}>
                {hasData ?
                    <ReactApexChart
                        options={options}
                        series={series}
                        type="donut"
                        width="100%"
                    />
                    : <Text textAlign="center" color="gray.500">No data yet</Text>
                }
            </Grid>
        </Card >
    )
}

export default ReportChart
