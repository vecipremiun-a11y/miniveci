import { AccountSidebar } from '@/components/account/AccountSidebar';
import { ProfileSummary } from '@/components/account/ProfileSummary';
import { OrderHistory } from '@/components/account/OrderHistory';

export default function AccountPage() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Sidebar - Left */}
            <div className="lg:col-span-3">
                <AccountSidebar />
            </div>

            {/* Main Content - Right */}
            <div className="lg:col-span-9">
                <ProfileSummary />
                <OrderHistory />
            </div>
        </div>
    );
}
