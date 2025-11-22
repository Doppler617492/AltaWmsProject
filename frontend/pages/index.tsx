import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import LoginForm from '../components/LoginForm';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if there's a token in localStorage on mount
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userInfo = {
          id: payload.sub,
          username: payload.username,
          role: payload.role,
          name: payload.username === 'admin' ? 'System Admin' : 
                payload.username === 'menadzer' ? 'Menadžer Skladišta' :
                payload.username === 'sef' ? 'Šef Skladišta' :
                payload.username === 'magacioner' ? 'Magacioner' :
                payload.username === 'komercijalista' ? 'Komercijalista' : 'User'
        };
        setUser(userInfo);
        setIsAuthenticated(true);
        // Redirect authenticated users to new dashboard shell
        router.replace('/dashboard');
      } catch (error) {
        console.error('Error decoding token:', error);
        localStorage.removeItem('token'); // Remove invalid token
      }
    }
  }, []);

  const handleLogin = (token: string) => {
    localStorage.setItem('token', token);
    // Decode token to get user info
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userInfo = {
        id: payload.sub,
        username: payload.username,
        role: payload.role,
        name: payload.username === 'admin' ? 'System Admin' : 
              payload.username === 'menadzer' ? 'Menadžer Skladišta' :
              payload.username === 'sef' ? 'Šef Skladišta' :
              payload.username === 'magacioner' ? 'Magacioner' :
              payload.username === 'komercijalista' ? 'Komercijalista' : 'User'
      };
      setUser(userInfo);
      setIsAuthenticated(true);
      // Go to the new dashboard after successful login
      router.replace('/dashboard');
    } catch (error) {
      console.error('Error decoding token:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <div>
      {!isAuthenticated ? (
        <LoginForm onLogin={handleLogin} />
      ) : null}
    </div>
  );
}
