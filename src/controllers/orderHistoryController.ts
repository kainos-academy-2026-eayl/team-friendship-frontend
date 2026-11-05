import { type Request, type Response, Router } from 'express';
import {
    getOrderHistory,
    type OrderHistoryItem,
} from '../services/orderHistoryService';
import orderHistoryPage from '../views/pages/order_history/order_history';
import { backendUrl } from './sessionController';

const router = Router();

function groupByOrder(items: OrderHistoryItem[]) {
    const orders = new Map<
        number,
        {
            orderId: number;
            date: string;
            status: string;
            items: { product: string; quantity: number; }[];
        }
    >();

    for (const item of items) {
        const order = orders.get(item.orderId) ?? {
            orderId: item.orderId,
            date: item.date,
            status: item.status,
            items: [],
        };
        order.items.push({ product: item.product, quantity: item.quantity });
        orders.set(item.orderId, order);
    }

    return [...orders.values()];
}

router.get('/', async (_req: Request, res: Response) => {
    const customerID = res.locals.customerId;

    if (!customerID) {
        res.redirect('/login');
        return;
    }

    const result = await getOrderHistory(
        backendUrl(),
        res.locals.accessToken,
        customerID,
    );

    if (!result.ok) {
        res.render('order_history/order_history', {
            page: {
                ...orderHistoryPage,
                orders: [],
            },
            error: result.message,
        });
        return;
    }

    res.render('order_history/order_history', {
        page: {
            ...orderHistoryPage,
            orders: groupByOrder(result.orders),
        },
    });
});

export default router;
