import { Tooltip as TooltipPrimitive } from 'bits-ui';
import Trigger from './tooltip-trigger.svelte';
import Content from './tooltip-content.svelte';

/* eslint-disable @typescript-eslint/no-explicit-any */
// bits-ui re-export: $$IsomorphicComponent type cannot be named in declarations
const Root = TooltipPrimitive.Root as any;
const Provider = TooltipPrimitive.Provider as any;
const Portal = TooltipPrimitive.Portal as any;

export {
	Root,
	Trigger,
	Content,
	Provider,
	Portal,
	//
	Root as Tooltip,
	Content as TooltipContent,
	Trigger as TooltipTrigger,
	Provider as TooltipProvider,
	Portal as TooltipPortal
};
