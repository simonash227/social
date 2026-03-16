import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Social Content Engine</h1>
        <p className="mt-2 text-muted-foreground">
          Your automated social media content engine is ready.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>Set up your first brand to begin generating content</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Navigate to <strong>Brands</strong> to create your first brand profile. Once set up,
              the engine will automatically generate and schedule content.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
            <CardDescription>Automated content from source to publish</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Configure brand voice and style</li>
              <li>Add RSS/YouTube/Reddit feed sources</li>
              <li>AI generates content from trending topics</li>
              <li>Content auto-publishes on schedule</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Check-In</CardTitle>
            <CardDescription>Minimal time investment required</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Once configured, just check in weekly to review performance, approve flagged posts,
              and adjust settings. Everything else runs autonomously.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
