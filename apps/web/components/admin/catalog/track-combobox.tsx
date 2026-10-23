"use client";

import { useState } from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import * as api from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function TrackCombobox({
  tracks,
  value,
  onChange,
}: {
  tracks: api.TrackPickerEntry[];
  value: string;
  onChange: (trackId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = tracks.find((t) => t.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between border-akosi-fg/15 bg-transparent! font-normal text-akosi-fg! hover:bg-akosi-fg/10!"
        >
          <span className="min-w-0 truncate">
            {selected
              ? `${selected.title} — ${selected.releaseTitle} (${selected.artistName})`
              : "Choose a track"}
          </span>
          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) bg-akosi-surface p-0 text-akosi-fg"
      >
        <Command className="bg-transparent">
          <CommandInput placeholder="Search tracks, releases, artists…" />
          <CommandList>
            <CommandEmpty>No tracks found.</CommandEmpty>
            <CommandGroup>
              {tracks.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`${t.title} ${t.releaseTitle} ${t.artistName}`}
                  onSelect={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                >
                  <CheckIcon className={cn("size-4 shrink-0", t.id === value ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0">
                    <p className="truncate">{t.title}</p>
                    <p className="truncate text-xs text-akosi-muted-fg">
                      {t.releaseTitle} — {t.artistName}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
