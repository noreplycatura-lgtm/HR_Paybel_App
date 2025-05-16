import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login');
  return null; // Or a loading spinner, but redirect is usually fast enough
}
