"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavItem } from "@/lib/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar"; // Ensure this hook exists and provides 'state'

interface SidebarNavProps {
  items: NavItem[];
}

export function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();
  const { state: sidebarState } = useSidebar(); // 'state' can be "expanded" or "collapsed"

  if (!items?.length) {
    return null;
  }

  return (
    <nav className="grid items-start gap-2">
      {items.map((item, index) => {
        const Icon = item.icon;
        const isActive = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
        
        return item.href ? (
          <Tooltip key={index} delayDuration={0}>
            <TooltipTrigger asChild>
              <Link
                href={item.disabled ? "#" : item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground",
                  item.disabled && "cursor-not-allowed opacity-50",
                  sidebarState === "collapsed" && "justify-center"
                )}
                aria-disabled={item.disabled}
                tabIndex={item.disabled ? -1 : undefined}
              >
                <Icon className="h-4 w-4" />
                {sidebarState === "expanded" && (
                  <span className="truncate">{item.title}</span>
                )}
              </Link>
            </TooltipTrigger>
            {sidebarState === "collapsed" && (
              <TooltipContent side="right" className="bg-sidebar text-sidebar-foreground border-sidebar-border">
                {item.title}
              </TooltipContent>
            )}
          </Tooltip>
        ) : null;
      })}
    </nav>
  );
}
