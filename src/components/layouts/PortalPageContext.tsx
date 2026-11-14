'use client';

/**
 * PORTAL PAGE CONTEXT — lets any page inside a PortalShell declare its
 * dynamic page title, description and submenu links. The module header
 * renders them (Instruction 15): pages themselves start at stat cards.
 */

import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';

export interface PortalPageMeta {
  title?: string;
  description?: string;
  subMenu?: Array<{ label: string; href: string; icon?: ReactNode }>;
}

interface PortalPageContextType {
  page: PortalPageMeta;
  setPage: (meta: PortalPageMeta) => void;
}

const PortalPageContext = createContext<PortalPageContextType>({
  page: {},
  setPage: () => {},
});

export function PortalPageProvider({ children }: { children: ReactNode }) {
  const [page, setPageState] = useState<PortalPageMeta>({});
  const setPage = useMemo(() => (meta: PortalPageMeta) => setPageState(meta), []);
  return (
    <PortalPageContext.Provider value={{ page, setPage }}>
      {children}
    </PortalPageContext.Provider>
  );
}

export function usePortalPage() {
  return useContext(PortalPageContext);
}

/** Declarative helper — call inside a page component. */
export function PortalPage({ meta }: { meta: PortalPageMeta }) {
  const { setPage } = usePortalPage();
  useEffect(() => {
    setPage(meta);
    return () => setPage({});
  }, [meta, setPage]);
  return null;
}
