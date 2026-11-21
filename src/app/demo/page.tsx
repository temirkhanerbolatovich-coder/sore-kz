import ShopPage, { generateMetadata as shopMetadata } from "../[slug]/page";

type Props = { searchParams: Promise<{ lang?: string; cat?: string }> };
const params = () => Promise.resolve({ slug: process.env.DEMO_SLUG || "demo" });
export function generateMetadata(props: Props) {
  return shopMetadata({ ...props, params: params() });
}
export default function DemoPage(props: Props) {
  return <ShopPage {...props} params={params()} />;
}
