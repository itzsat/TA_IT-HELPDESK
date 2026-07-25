// Temporary type declarations for React until @types/react is installed
// This file can be removed after running: npm install

declare module 'react' {
  export interface ReactElement<P = any, T = any> {
    type: T;
    props: P;
    key: string | number | null;
  }
  
  export type ReactNode = ReactElement | string | number | boolean | null | undefined;
  
  export interface Component<P = {}, S = {}, SS = any> {
    props: P;
    state: S;
    context: any;
    refs: any;
  }
  
  export interface ComponentClass<P = {}, S = ComponentState> {
    new (props: P, context?: any): Component<P, S>;
  }
  
  export interface ComponentState {}
  
  export type ComponentType<P = {}> = ComponentClass<P> | FunctionComponent<P>;
  
  export interface FunctionComponent<P = {}> {
    (props: P, context?: any): ReactElement | null;
  }
  
  export function useState<S>(initialState: S | (() => S)): [S, (value: S | ((prev: S) => S)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useRef<T>(initialValue: T): { current: T };
  export function useContext<T>(context: Context<T>): T;
  export function useMemo<T>(factory: () => T, deps: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
  
  export interface Context<T> {
    Provider: ComponentClass<{ value: T; children?: ReactNode }>;
    Consumer: ComponentClass<{ children: (value: T) => ReactNode }>;
  }
  
  export function createContext<T>(defaultValue: T): Context<T>;
  
  export interface ChangeEvent<T = Element> extends SyntheticEvent<T> {
    target: EventTarget & T;
  }
  
  export interface SyntheticEvent<T = Element, E = Event> {
    currentTarget: EventTarget & T;
    target: EventTarget & T;
    bubbles: boolean;
    cancelable: boolean;
    defaultPrevented: boolean;
    eventPhase: number;
    isTrusted: boolean;
    nativeEvent: E;
    preventDefault(): void;
    stopPropagation(): void;
    timeStamp: number;
    type: string;
  }
  
  export interface FormEvent<T = Element> extends SyntheticEvent<T> {
  }
  
  export interface HTMLAttributes<T> extends DOMAttributes<T> {
    className?: string;
    id?: string;
    style?: CSSProperties;
  }
  
  export interface DOMAttributes<T> {
    children?: ReactNode;
    dangerouslySetInnerHTML?: { __html: string };
    onClick?: (event: MouseEvent<T>) => void;
    onChange?: (event: ChangeEvent<T>) => void;
    onInput?: (event: FormEvent<T>) => void;
    onSubmit?: (event: FormEvent<T>) => void;
  }
  
  export interface ImgHTMLAttributes<T> extends HTMLAttributes<T> {
    alt?: string;
    src?: string;
    onError?: () => void;
  }
  
  export interface CSSProperties {
    [key: string]: string | number | undefined;
  }
  
  export interface MouseEvent<T = Element> extends SyntheticEvent<T, MouseEvent> {
    altKey: boolean;
    button: number;
    buttons: number;
    clientX: number;
    clientY: number;
    ctrlKey: boolean;
    metaKey: boolean;
    movementX: number;
    movementY: number;
    pageX: number;
    pageY: number;
    relatedTarget: EventTarget | null;
    screenX: number;
    screenY: number;
    shiftKey: boolean;
  }
  
  export interface Element {
    // DOM element
  }
  
  export interface EventTarget {
    // DOM EventTarget
  }
  
  const React: {
    useState: typeof useState;
    useEffect: typeof useEffect;
    useRef: typeof useRef;
    useContext: typeof useContext;
    useMemo: typeof useMemo;
    useCallback: typeof useCallback;
    createContext: typeof createContext;
    Component: ComponentClass<any, any>;
    Fragment: ComponentType<{ children?: ReactNode }>;
  };
  
  export default React;
}

// Global React namespace
declare namespace React {
  interface ReactElement<P = any, T = any> {
    type: T;
    props: P;
    key: string | number | null;
  }
  
  type ReactNode = ReactElement | string | number | boolean | null | undefined;
  
  interface ChangeEvent<T = Element> {
    target: EventTarget & T;
  }
  
  interface SyntheticEvent<T = Element, E = Event> {
    currentTarget: EventTarget & T;
    target: EventTarget & T;
    bubbles: boolean;
    cancelable: boolean;
    defaultPrevented: boolean;
    eventPhase: number;
    isTrusted: boolean;
    nativeEvent: E;
    preventDefault(): void;
    stopPropagation(): void;
    timeStamp: number;
    type: string;
  }
  
  interface FormEvent<T = Element> extends SyntheticEvent<T> {
  }
  
  interface HTMLAttributes<T> extends DOMAttributes<T> {
    className?: string;
    id?: string;
    style?: CSSProperties;
  }
  
  interface DOMAttributes<T> {
    children?: ReactNode;
    dangerouslySetInnerHTML?: { __html: string };
    onClick?: (event: MouseEvent<T>) => void;
    onChange?: (event: ChangeEvent<T>) => void;
    onInput?: (event: FormEvent<T>) => void;
    onSubmit?: (event: FormEvent<T>) => void;
  }
  
  interface CSSProperties {
    [key: string]: string | number | undefined;
  }
  
  interface MouseEvent<T = Element> extends SyntheticEvent<T, MouseEvent> {
    altKey: boolean;
    button: number;
    buttons: number;
    clientX: number;
    clientY: number;
    ctrlKey: boolean;
    metaKey: boolean;
    movementX: number;
    movementY: number;
    pageX: number;
    pageY: number;
    relatedTarget: EventTarget | null;
    screenX: number;
    screenY: number;
    shiftKey: boolean;
  }
  
  interface Element {
    // DOM element
  }
  
  interface EventTarget {
    // DOM EventTarget
  }
}

// Global JSX namespace - MUST be at global scope
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
    interface Element extends React.ReactElement<any, any> {}
    interface ElementClass {
      render(): React.ReactNode;
    }
    interface ElementAttributesProperty {
      props: {};
    }
    interface ElementChildrenAttribute {
      children: {};
    }
  }
}

// Export empty object to make this a module
export {};

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
  export function Fragment(props: { children?: any }): any;
}

declare module 'react-dom/client' {
  export interface Root {
    render(children: any): void;
    unmount(): void;
  }
  
  export function createRoot(container: Element | DocumentFragment): Root;
}

