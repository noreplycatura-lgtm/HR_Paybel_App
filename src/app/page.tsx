
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard'); // Redirect to dashboard by default
  // The redirect function throws an error, so execution stops here.
}
