import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function DashboardLayout({ status, children, page, onNavigate, pageTitle, onRefresh, refreshing }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper md:flex-row">
      <Sidebar page={page} onNavigate={onNavigate} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar status={status} pageTitle={pageTitle} onRefresh={onRefresh} refreshing={refreshing} />
        <main className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  )
}
