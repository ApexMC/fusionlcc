"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type SmartSelectOption = {
  value: string | number
  label: string
  disabled?: boolean
  keywords?: string[]
}

type NativeSelectProps = Omit<
  React.ComponentProps<"select">,
  "children" | "defaultValue" | "multiple" | "onChange" | "size" | "value"
>

export type SmartSelectProps = NativeSelectProps & {
  options: readonly SmartSelectOption[]
  value?: string | number
  defaultValue?: string | number
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  maxNativeOptions?: number
}

export function SmartSelect({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  searchPlaceholder = "Search options...",
  emptyMessage = "No option found.",
  maxNativeOptions = 8,
  className,
  disabled,
  required,
  onInvalid,
  ...selectProps
}: SmartSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [uncontrolledValue, setUncontrolledValue] = React.useState(() =>
    String(defaultValue ?? "")
  )
  const [invalid, setInvalid] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const isControlled = value !== undefined
  const selectedValue = isControlled ? String(value) : uncontrolledValue
  const selectedOption = options.find(
    (option) => String(option.value) === selectedValue
  )
  const displayValue = selectedOption?.label ?? placeholder ?? "Select an option"

  function selectValue(nextValue: string) {
    if (!isControlled) {
      setUncontrolledValue(nextValue)
    }

    setInvalid(false)
    onValueChange?.(nextValue)
  }

  if (options.length <= maxNativeOptions) {
    return (
      <select
        {...selectProps}
        value={selectedValue}
        required={required}
        disabled={disabled}
        onInvalid={onInvalid}
        onChange={(event) => selectValue(event.target.value)}
        className={className}
      >
        {options.map((option) => (
          <option
            key={String(option.value)}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div
      className={cn(
        "relative min-w-0",
        className?.includes("w-full") && "w-full",
        className?.includes("flex-1") && "flex-1"
      )}
    >
      <select
        {...selectProps}
        value={selectedValue}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute size-px opacity-0"
        onChange={(event) => selectValue(event.target.value)}
        onInvalid={(event) => {
          setInvalid(true)
          setOpen(true)
          onInvalid?.(event)
          requestAnimationFrame(() => triggerRef.current?.focus())
        }}
      >
        {options.map((option) => (
          <option
            key={String(option.value)}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-required={required || undefined}
            aria-invalid={invalid || undefined}
            aria-label={selectProps["aria-label"]}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !selectedOption && "text-muted-foreground",
              className
            )}
          >
            <span className="min-w-0 truncate text-left">{displayValue}</span>
            <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-48 p-0"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              {options.map((option) => {
                const optionValue = String(option.value)

                return (
                  <CommandItem
                    key={optionValue}
                    value={`${option.label} ${optionValue} ${
                      option.keywords?.join(" ") ?? ""
                    }`}
                    disabled={option.disabled}
                    onSelect={() => {
                      selectValue(optionValue)
                      setOpen(false)
                      requestAnimationFrame(() => triggerRef.current?.focus())
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "size-4",
                        selectedValue === optionValue
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    <span>{option.label}</span>
                  </CommandItem>
                )
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
