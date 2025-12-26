import { useState } from 'react';

export function useNavigate() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return navigate;
}

export function useLocation() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  window.addEventListener('popstate', () => {
    setCurrentPath(window.location.pathname);
  });

  return currentPath;
}
