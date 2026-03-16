import Link from 'next/link'
import {
  LayoutDashboard,
  Building2,
  Calendar,
  ScrollText,
  Settings,
  ChevronDown,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getDb } from '@/db'
import { brands } from '@/db/schema'

const navItems = [
  { label: 'Home', href: '/', icon: LayoutDashboard },
  { label: 'Brands', href: '/brands', icon: Building2 },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'Activity Log', href: '/activity', icon: ScrollText },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export async function AppSidebar() {
  const db = getDb()
  const allBrands = db.select({ id: brands.id, name: brands.name }).from(brands).all() as { id: number; name: string }[]

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors outline-none">
            <span>All Brands</span>
            <ChevronDown className="size-4 shrink-0 opacity-50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem>
              <Link href="/" className="w-full">All Brands</Link>
            </DropdownMenuItem>
            {allBrands.map((brand) => (
              <DropdownMenuItem key={brand.id}>
                <Link href={`/brands/${brand.id}`} className="w-full">{brand.name}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  }
                  tooltip={item.label}
                />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
          Social Content Engine
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
