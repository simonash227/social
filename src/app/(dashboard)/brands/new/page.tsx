import { BrandForm } from '@/components/brand-form'

export default function NewBrandPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Create Brand</h1>
      <BrandForm action="create" />
    </div>
  )
}
