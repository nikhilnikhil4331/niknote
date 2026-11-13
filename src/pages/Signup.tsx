import { Navigate } from 'react-router-dom';
import { NiknoteAuth } from '@/components/auth/NiknoteAuth';
import { SIGNUP_ENABLED } from '@/config/features';

export default function Signup() {
  return SIGNUP_ENABLED ? <NiknoteAuth mode="signup" /> : <Navigate to="/login" replace />;
}
