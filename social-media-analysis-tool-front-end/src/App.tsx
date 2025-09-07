import { Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import SentimentPage from "./pages/Sentiment";
import TopicsPage from "./pages/Topics.tsx";
import ReportsPage from "./pages/Reports.tsx";
import SettingsPage from "./pages/Settings.tsx";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="sentiment" element={<SentimentPage />} />
          <Route path="topics" element={<TopicsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </QueryClientProvider>
  );
}
