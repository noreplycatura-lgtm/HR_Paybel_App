
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard'); // Changed to redirect to dashboard for public view
  return null; 
}
