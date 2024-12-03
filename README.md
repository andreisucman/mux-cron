docker build --no-cache -t sunchainltd/mux-cron-[NAME AND TAG] ./path
docker push sunchainltd/mux-cron-[NAME AND TAG]

docker build --no-cache -t sunchainltd/mux-cron-check-expired-tasks:1.0 ./checkExpiredTasks
docker push sunchainltd/mux-cron-check-expired-tasks:1.0

docker build --no-cache -t sunchainltd/mux-cron-delete-accounts:1.0 ./deleteAccounts
docker push sunchainltd/mux-cron-delete-accounts:1.0

docker build --no-cache -t sunchainltd/mux-cron-find-products-for-general-tasks:1.0 ./findProductsForGeneralTasks
docker push sunchainltd/mux-cron-find-products-for-general-tasks:1.0

docker build --no-cache -t sunchainltd/mux-cron-increase-coach-energy:1.0 ./increaseCoachEnergy
docker push sunchainltd/mux-cron-increase-coach-energy:1.0

docker build --no-cache -t sunchainltd/mux-cron-update-club-activity:1.0 ./updateClubActivity
docker push sunchainltd/mux-cron-update-club-activity:1.0
