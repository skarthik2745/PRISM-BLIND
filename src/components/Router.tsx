import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Login from '../pages/Login';
import CreateAccount from '../pages/CreateAccount';
import PatientDashboard from '../pages/PatientDashboard';
import DoctorDashboard from '../pages/DoctorDashboard';

export default function Router() {
  const { user, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-3xl text-slate-700">Loading...</div>
      </div>
    );
  }

  if (!user) {
    if (currentPath === '/create-account') {
      return <CreateAccount />;
    }
    return <Login />;
  }

  if (user.role === 'patient') {
    return <PatientDashboard />;
  }

  return <DoctorDashboard />;
}
