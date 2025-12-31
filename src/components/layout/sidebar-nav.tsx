"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { type NavItem } from "@/lib/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";

interface SidebarNavProps {
  items: NavItem[];
}

export function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();
  const { state: sidebarState } = useSidebar();

  if (!items?.length) {
    return null;
  }

  return (
    <nav className="grid items-start gap-1">
      {items.map((item, index) => {
        const Icon = item.icon;
        const isActive = item.href === "/" 
          ? pathname === item.href 
          : pathname.startsWith(item.href);

        return item.href ? (
          <Tooltip key={index} delayDuration={0}>
            <TooltipTrigger asChild>
              <Link
                href={item.disabled ? "#" : item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  "text-slate-300 hover:text-white hover:bg-slate-700",
                  isActive && "bg-blue-600 text-white hover:bg-blue-700",
                  item.disabled && "cursor-not-allowed opacity-50",
                  sidebarState === "collapsed" && "justify-center px-2"
                )}
                aria-disabled={item.disabled}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {sidebarState === "expanded" && (
                  <span className="truncate">{item.title}</span>
                )}
              </Link>
            </TooltipTrigger>
            {sidebarState === "collapsed" && (
              <TooltipContent side="right" className="bg-slate-800 text-white border-slate-700">
                {item.title}
              </TooltipContent>
            )}
          </Tooltip>
        ) : null;
      })}
    </nav>
  );
}