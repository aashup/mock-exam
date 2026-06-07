import {Link} from 'react-router-dom';
import {useSubjects} from '@/hooks/useSubjects';
import {useCourses} from '@/hooks/useCourses';
import {useUsers} from '@/hooks/useAdminData';
import {PageHeader} from '@/components/PageHeader';

function StatCard({label, value, to}: {label: string; value: number | string; to: string}) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-slate-800">{value}</div>
    </Link>
  );
}

export function DashboardPage() {
  const subjects = useSubjects();
  const courses = useCourses();
  const users = useUsers(1);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of your catalog and users" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Subjects" value={subjects.data?.length ?? '—'} to="/subjects" />
        <StatCard label="Courses" value={courses.data?.length ?? '—'} to="/courses" />
        <StatCard label="Users" value={users.data?.total ?? '—'} to="/users" />
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Quick actions</h2>
        <p className="mt-1 text-sm text-slate-500">
          Add subjects and courses, then attach subjects to courses from the Courses page.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/subjects"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Manage Subjects
          </Link>
          <Link
            to="/courses"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Manage Courses
          </Link>
        </div>
      </div>
    </div>
  );
}
