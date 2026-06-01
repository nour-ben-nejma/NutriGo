import './globals.css';
import ClientLayout from './ClientLayout';

export const metadata = {
  title: 'NutriGo | Votre Assistant Nutritionnel Personnel',
  description: "Suivez vos calories et obtenez des conseils nutritionnels grâce à notre IA experte.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
