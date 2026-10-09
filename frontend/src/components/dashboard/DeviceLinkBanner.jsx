import { LoaderCircle, TriangleAlert } from 'lucide-react'

export default function DeviceLinkBanner({ device, loading, error }) {
  if (loading) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-3 text-sm text-ash-600">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Checking your linked device in Supabase&hellip;
      </div>
    )
  }

  if (error) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-danger-soft bg-danger-soft px-4 py-3 text-sm text-danger">
        <TriangleAlert className="h-4 w-4" />
        Could not reach Supabase: {error.message}
      </div>
    )
  }

  if (!device) {
    return (
      <div className="mb-4 rounded-lg border border-amber-soft bg-amber-soft px-4 py-3 text-sm text-amber">
        No device is linked to your account yet. The widgets below are still running on simulated
        data. Insert a row into <code className="font-mono">devices</code> with your user id as
        owner to link one, no hardware required &mdash; see the README.
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-lg border border-line bg-white px-4 py-3 text-sm text-ash-600">
      Linked device: <span className="font-medium text-ash-900">{device.device_name}</span> from
      Supabase. Location and obstacle widgets below are still simulated until Phase 6.
    </div>
  )
}
