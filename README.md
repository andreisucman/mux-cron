docker build --no-cache -t sunchainltd/myo-cron-[NAME AND TAG] ./path
docker push sunchainltd/myo-cron-[NAME AND TAG]

docker build --no-cache -t sunchainltd/myo-cron-check-expired-tasks:1.0 ./checkExpiredTasks
docker push sunchainltd/myo-cron-check-expired-tasks:1.0

docker build --no-cache -t sunchainltd/myo-cron-delete-accounts:1.0 ./deleteAccounts
docker push sunchainltd/myo-cron-delete-accounts:1.0

docker build --no-cache -t sunchainltd/myo-cron-find-products-for-general-tasks:1.0 ./findProductsForGeneralTasks
docker push sunchainltd/myo-cron-find-products-for-general-tasks:1.0

docker build --no-cache -t sunchainltd/myo-cron-increase-coach-energy:1.0 ./increaseCoachEnergy
docker push sunchainltd/myo-cron-increase-coach-energy:1.0

docker build --no-cache -t sunchainltd/myo-cron-update-club-activity:1.0 ./updateClubActivity
docker push sunchainltd/myo-cron-update-club-activity:1.0