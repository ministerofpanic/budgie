const AppLoading = () => (
  <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="Loading">
    <div className="bg-muted h-24 rounded-xl" />
    <div className="flex flex-col gap-3">
      <div className="bg-muted h-4 w-24 rounded" />
      <div className="bg-muted h-14 rounded-lg" />
      <div className="bg-muted h-14 rounded-lg" />
      <div className="bg-muted h-14 rounded-lg" />
    </div>
  </div>
);

export default AppLoading;
