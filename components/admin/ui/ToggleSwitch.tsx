import { Switch } from "@/components/ui/switch";

interface ToggleSwitchProps {
    id?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description?: string;
    disabled?: boolean;
}

export function ToggleSwitch({ id, checked, onChange, label, description, disabled = false }: ToggleSwitchProps) {
    const defaultId = id || `toggle-${label.replace(/\s+/g, '-').toLowerCase()}`;

    return (
        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
                <label
                    htmlFor={defaultId}
                    className="text-base font-medium cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                    {label}
                </label>
                {description && (
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            <Switch
                id={defaultId}
                checked={checked}
                onCheckedChange={onChange}
                disabled={disabled}
                aria-label={label}
            />
        </div>
    );
}
