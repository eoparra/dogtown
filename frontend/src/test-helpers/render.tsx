import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';

/**
 * Custom render that wraps the component in a MemoryRouter.
 * Use this for components that rely on React Router hooks (useNavigate, Link, etc.).
 * For simple page components like InventoryPage that don't use routing hooks,
 * plain `render()` from @testing-library/react is sufficient.
 */
function RouterWrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

export function renderWithRouter(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: RouterWrapper, ...options });
}

// Re-export everything from RTL for convenience
export * from '@testing-library/react';
