import { redirect } from 'next/navigation';

/** Redirige la page d'accueil vers la page de connexion. */
export default function HomePage() {
  redirect('/login');
}
