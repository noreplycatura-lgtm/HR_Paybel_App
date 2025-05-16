
import { redirect } from 'next/navigation';

export default function DashboardRootPage() {
  redirect('/dashboard');
  // The redirect function throws an error, so execution stops here.
  // No need for a return null;
}
