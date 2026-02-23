import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmVariant = "danger" | "warning" | "info";

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    cancelLabel?: string;
    confirmLabel?: string;
    variant?: ConfirmVariant;
}

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    message,
    onConfirm,
    onCancel,
    cancelLabel = "Cancelar",
    confirmLabel = "Confirmar",
    variant = "danger",
}: ConfirmDialogProps) {

    const handleConfirm = () => {
        onConfirm();
        onOpenChange(false);
    };

    const handleCancel = () => {
        if (onCancel) onCancel();
        onOpenChange(false);
    };

    const getVariantStyling = () => {
        switch (variant) {
            case "danger": return "bg-red-600 hover:bg-red-700 focus:ring-red-600 text-white";
            case "warning": return "bg-amber-600 hover:bg-amber-700 focus:ring-amber-600 text-white";
            case "info": return "bg-blue-600 hover:bg-blue-700 focus:ring-blue-600 text-white";
            default: return "";
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {message}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={handleCancel}>
                        {cancelLabel}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        className={getVariantStyling()}
                    >
                        {confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
