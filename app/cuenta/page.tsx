import { ProfileSummary } from '@/components/account/ProfileSummary';
import { OrderHistory } from '@/components/account/OrderHistory';

export default function AccountPage() {
    return (
        <>
            <ProfileSummary />
            <OrderHistory />
        </>
    );
}
