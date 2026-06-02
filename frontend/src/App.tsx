import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import TicketInbox from './pages/TicketInbox';
import TicketDetail from './pages/TicketDetail';
import NewTicket from './pages/NewTicket';
import AgentDashboard from './pages/AgentDashboard';
import Analytics from './pages/Analytics';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/tickets" replace />} />
          <Route path="tickets" element={<TicketInbox />} />
          <Route path="tickets/new" element={<NewTicket />} />
          <Route path="tickets/:id" element={<TicketDetail />} />
          <Route path="dashboard" element={<AgentDashboard />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
