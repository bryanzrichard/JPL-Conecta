import React from 'react';

const Command = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`p-1 ${className}`}
    {...props}
  />
));
Command.displayName = 'Command';

const CommandInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full bg-gray-800 border-b border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none ${className}`}
    {...props}
  />
));
CommandInput.displayName = 'CommandInput';

const CommandList = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={`mt-1 space-y-0.5 ${className}`}
    {...props}
  />
));
CommandList.displayName = 'CommandList';

const CommandEmpty = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => (
  <div
    ref={ref}
    className="py-4 text-center text-sm text-gray-400"
    {...props}
  />
));
CommandEmpty.displayName = 'CommandEmpty';

const CommandGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={className}
    {...props}
  />
));
CommandGroup.displayName = 'CommandGroup';


type CommandItemProps = React.LiHTMLAttributes<HTMLLIElement> & {
  onSelect?: () => void;
};
const CommandItem = React.forwardRef<
  HTMLLIElement,
  CommandItemProps
>(({ className, onSelect, ...props }, ref) => (
    <li 
        ref={ref}
        className={`px-3 py-2 text-sm rounded-md text-gray-300 hover:bg-gray-800 hover:text-white transition-colors cursor-pointer ${className}`}
        onClick={onSelect}
        {...props}
    />
));
CommandItem.displayName = 'CommandItem';

const CommandSeparator = React.forwardRef<
  HTMLHRElement,
  React.HTMLAttributes<HTMLHRElement>
>(({ className, ...props }, ref) => (
  <hr
    ref={ref}
    className={`border-gray-700 my-1 ${className}`}
    {...props}
  />
));
CommandSeparator.displayName = 'CommandSeparator';

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
};
