import { RouterProvider } from 'react-router';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { router } from './routes';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SessionProvider } from './auth/SessionContext';


export default function App() {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <RouterProvider router={router} />
          <Toaster position="top-right" />
        </ThemeProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}

