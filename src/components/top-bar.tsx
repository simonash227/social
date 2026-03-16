import { SidebarTrigger } from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function TopBar() {
  const aiMode = process.env.AI_MODE ?? 'testing'
  const isTesting = aiMode === 'testing'

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <span className="text-sm font-medium text-foreground">
          Social Content Engine
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* AI_MODE badge */}
        <Badge
          className={
            isTesting
              ? 'bg-green-600/20 text-green-400 border-green-600/30 hover:bg-green-600/20'
              : 'bg-orange-600/20 text-orange-400 border-orange-600/30 hover:bg-orange-600/20'
          }
        >
          AI_MODE: {aiMode.toUpperCase()}
        </Badge>

        {/* System health dot with tooltip */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="flex items-center gap-1.5 cursor-default outline-none">
              <span className="size-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
              <span className="text-xs text-muted-foreground">Healthy</span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>System healthy</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  )
}
