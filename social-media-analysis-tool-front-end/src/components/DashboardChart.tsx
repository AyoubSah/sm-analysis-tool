import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type GenericRecord = Record<string, number | string | null | undefined>;
interface LineProps {
  data: GenericRecord[];
  dataKey: string;
  stroke?: string;
}
interface PieProps {
  data: GenericRecord[];
  dataKey: string;
  nameKey: string;
  colors?: string[];
}
interface BarProps {
  data: GenericRecord[];
  dataKey: string;
  nameKey: string;
}

export function DashboardLineChart({
  data,
  dataKey,
  stroke = "#3b82f6",
}: LineProps) {
  return (
    <ResponsiveContainer width="100%" height={150}>
      <LineChart data={data}>
        <Line type="monotone" dataKey={dataKey} stroke={stroke} />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DashboardPieChart({
  data,
  dataKey,
  nameKey,
  colors = ["#3b82f6", "#fbbf24", "#10b981"],
}: PieProps) {
  return (
    <ResponsiveContainer width="100%" height={150}>
      <PieChart>
        <Pie data={data} dataKey={dataKey} nameKey={nameKey} outerRadius={60}>
          {data.map((_, index) => (
            <Cell key={index} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DashboardBarChart({ data, dataKey, nameKey }: BarProps) {
  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={data}>
        <Bar dataKey={dataKey} fill="#3b82f6" />
        <XAxis dataKey={nameKey} />
        <YAxis />
        <Tooltip />
      </BarChart>
    </ResponsiveContainer>
  );
}
