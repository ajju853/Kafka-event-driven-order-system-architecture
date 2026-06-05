import { configureStore, createSlice, PayloadAction } from "@reduxjs/toolkit";

interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

interface CartState {
  items: CartItem[];
  customerId: string | null;
}

const initialState: CartState = {
  items: [],
  customerId: null,
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addItem: (state, action: PayloadAction<CartItem>) => {
      const existing = state.items.find(
        (i) => i.productId === action.payload.productId
      );
      if (existing) {
        existing.quantity += action.payload.quantity;
      } else {
        state.items.push(action.payload);
      }
    },
    removeItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(
        (i) => i.productId !== action.payload
      );
    },
    updateQuantity: (
      state,
      action: PayloadAction<{ productId: string; quantity: number }>
    ) => {
      const item = state.items.find(
        (i) => i.productId === action.payload.productId
      );
      if (item) {
        item.quantity = action.payload.quantity;
      }
    },
    clearCart: (state) => {
      state.items = [];
    },
    setCustomerId: (state, action: PayloadAction<string>) => {
      state.customerId = action.payload;
    },
  },
});

export const { addItem, removeItem, updateQuantity, clearCart, setCustomerId } =
  cartSlice.actions;

export const store = configureStore({
  reducer: {
    cart: cartSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
