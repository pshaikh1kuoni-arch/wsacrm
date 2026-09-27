"use client";

/**
 * Node-type legend — what each canvas color means, collapsed behind a
 * single button + popover instead of a permanent row above the
 * canvas. Covers every node type, derived from NODE_META so a new
 * type can't silently go undocumented.
 */

import { Info } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CANVAS_MUTED_TEXT, NODE_META, nodeColors, type NodeType } from "./shared";

const LEGEND_TYPES = Object.keys(NODE_META) as NodeType[];

export function NodeTypeLegend() {
  const t = useTranslations("Flows.builder");

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="text-muted-foreground" />
        }
      >
        <Info className="h-3.5 w-3.5" />
        {t("legend")}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2.5">
        <div className="flex flex-col gap-1.5">
          {LEGEND_TYPES.map((type) => (
            <span
              key={type}
              className="inline-flex items-center gap-2 text-[12px]"
              style={{ color: CANVAS_MUTED_TEXT }}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: nodeColors(type).solid }}
              />
              {t(`nodes.${type}.label`)}
            </span>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
