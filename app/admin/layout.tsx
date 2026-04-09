import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <nav className="w-56 bg-[#5c4a2a] text-white flex flex-col p-4 gap-2">
        <h2 className="font-bold text-lg mb-4">Admin</h2>
        {[
          { href: '/admin', label: 'Dashboard' },
          { href: '/admin/pagos', label: 'Pagos' },
          { href: '/admin/ganadores', label: 'Ganadores' },
          { href: '/admin/sorteos', label: 'Sorteos' },
          { href: '/admin/configuracion', label: 'Configuración' },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="px-3 py-2 rounded hover:bg-[#8b7355] transition-colors text-sm">
            {item.label}
          </Link>
        ))}
      </nav>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
