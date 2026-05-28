import { motion } from "motion/react";
import { CreditCard, TrendingDown, Wallet, Zap } from "lucide-react";
import { useLanguage } from "../i18n";

export default function Balance() {
  const { t } = useLanguage();

  const stats = [
    { label: t.balance.currentBalance, value: "12,450", icon: Wallet },
    { label: t.balance.usage, value: "38,720", icon: TrendingDown },
    { label: t.balance.avgCost, value: "420", icon: Zap },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-6 md:p-12">
      <div className="mx-auto max-w-5xl space-y-10">
        <div>
          <h2 className="text-2xl font-medium text-white">{t.balance.title}</h2>
          <p className="mt-2 text-gray-400">{t.balance.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5"
            >
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
                <stat.icon className="h-5 w-5" strokeWidth={1.6} />
              </div>
              <div className="text-3xl font-medium text-white">{stat.value}</div>
              <div className="mt-2 text-sm text-gray-500">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        <section className="space-y-4">
          <h3 className="text-lg font-medium text-white">{t.balance.packagesTitle}</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {t.balance.packages.map((pack, index) => (
              <motion.div
                key={pack.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="flex min-h-52 flex-col rounded-2xl border border-white/10 bg-[#0D0D0D] p-5"
              >
                <div className="flex-1">
                  <h4 className="text-lg font-medium text-white">{pack.name}</h4>
                  <div className="mt-4 text-2xl font-medium text-white">{pack.price}</div>
                  <div className="mt-2 text-sm text-gray-400">{pack.amount}</div>
                  <p className="mt-4 text-sm leading-relaxed text-gray-500">{pack.note}</p>
                </div>
                <button className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200">
                  <CreditCard className="h-4 w-4" strokeWidth={1.8} />
                  {t.balance.topUp}
                </button>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-medium text-white">{t.balance.activityTitle}</h3>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A]">
            {t.balance.activity.map((item, index) => (
              <div
                key={`${item.label}-${item.date}`}
                className={`flex items-center justify-between gap-4 p-4 ${
                  index !== t.balance.activity.length - 1 ? "border-b border-white/5" : ""
                }`}
              >
                <div>
                  <div className="text-sm font-medium text-white">{item.label}</div>
                  <div className="mt-1 text-xs text-gray-600">{item.date}</div>
                </div>
                <div className={`text-sm font-medium ${item.value.startsWith("+") ? "text-white" : "text-gray-500"}`}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
