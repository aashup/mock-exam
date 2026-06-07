import {Navigate, Route, Routes} from 'react-router-dom';
import {Layout} from '@/components/Layout';
import {ProtectedRoute} from '@/components/ProtectedRoute';
import {LoginPage} from '@/pages/LoginPage';
import {DashboardPage} from '@/pages/DashboardPage';
import {SubjectsPage} from '@/pages/SubjectsPage';
import {CoursesPage} from '@/pages/CoursesPage';
import {GenerateQuestionsPage} from '@/pages/GenerateQuestionsPage';
import {QuestionsPage} from '@/pages/QuestionsPage';
import {UsersPage} from '@/pages/UsersPage';
import {ApiUsagePage} from '@/pages/ApiUsagePage';
import {ActivityLogsPage} from '@/pages/ActivityLogsPage';
import {DeviceLocationsPage} from '@/pages/DeviceLocationsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/subjects" element={<SubjectsPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/generate" element={<GenerateQuestionsPage />} />
        <Route path="/questions" element={<QuestionsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/api-usage" element={<ApiUsagePage />} />
        <Route path="/activity" element={<ActivityLogsPage />} />
        <Route path="/device-locations" element={<DeviceLocationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
