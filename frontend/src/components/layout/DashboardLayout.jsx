import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function DashboardLayout({ status, children }) {
  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar status={status} />
        <main className="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  )
}
