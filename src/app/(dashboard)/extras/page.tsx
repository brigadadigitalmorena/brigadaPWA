import { redirect } from 'next/navigation';

/** Bookmarks and stale SW caches of /extras land on the unified surveys list. */
export default function PrioritariasRedirectPage() {
  redirect('/surveys');
}
