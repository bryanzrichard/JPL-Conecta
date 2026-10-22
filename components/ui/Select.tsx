import React from 'react';
export const Select = ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props}>{children}</select>;
export const SelectGroup = ({ children, ...props }: React.OptgroupHTMLAttributes<HTMLOptGroupElement>) => <optgroup {...props}>{children}</optgroup>;
export const SelectValue = (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}/>;
export const SelectTrigger = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>;
export const SelectContent = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>;
export const SelectLabel = ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>;
export const SelectItem = ({ children, ...props }: React.OptionHTMLAttributes<HTMLOptionElement>) => <option {...props}>{children}</option>;
export const SelectSeparator = (props: React.HTMLAttributes<HTMLHRElement>) => <hr {...props} />;
