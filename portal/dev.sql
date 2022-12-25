#processing script, executed every day

# 20160905
# step 1. prepare the list of users and services for the specific day
# - prepare the list using users
# - insert this list into proc_users

#todo - script in js - DONE!
insert into  proc_users (user_id, email, date, service, done)  (
  select id, email, "2016-08-08" as job_period, 'uber' as service, false as done from users
  where reg_status = 7 and
  active = true
)
on duplicate key update
  counter = counter + 1;


# 20160906
# step 2. retrieve the trip details using the list from proc_users
# - insert the trip details into proc_raw_uber_trips

#todo - javascript processor


# 20160906
# step 3a. generate the dailypay parameters for *each* trip done for the specific date, using the trip details from proc_raw_uber_trips
# - SG Uber's day period is 0400hrs to next day 0359hrs
# - insert the generated data into p_uber_trip_payments

#todo - script in js - DONE!
insert into proc_computed_uber_trips
  #select *, now() as created_at, now() as updated_at from (
    #compute the job period and amounts
    select null as id, user_id, partner_id, trip_id, trip_date, vehicle, trip_time,
      driver, duration, distance, fare, status,
      #computed fields
      timestamp(trip_date, trip_time) as trip_datetime,
      if(trip_time > '17:30:00', adddate(trip_date, interval 1 day), trip_date) as job_period,
      timestamp(date(trip_date + interval (0 - weekday(trip_date)) day), '04:00') as pay_period_start,
      timestamp(date(trip_date + interval (7 - weekday(trip_date)) day), '03:59') as pay_period_end,
      #if(trip_time > '17:30:00', adddate(trip_date, interval 2 day), adddate(trip_date, interval 1 day)) as advance_date,
      null as advance_date,
      #round(0.9*fare, 2) as advance_amount,
      null as advance_amount,
      null as reserve_date,
      #round(0.1*fare, 2) as reserve_amount,
      null as reserve_amount,
      false as counter,
      false as processed,
      now() as created_at,
      now() as updated_at
      from proc_raw_uber_trips
      #get trips for a single job period
      # select * from w_uber_trips
      # job_period = 2016-08-09
    where (trip_date = '2016-08-08' and trip_time > '17:30:00') or
          (trip_date = '2016-08-09' and trip_time <= '17:30:00')
   # ) as u
on duplicate key update
  p_uber_trip_payments.counter = p_uber_trip_payments.counter + 1


# 20160927
# step 3b. continue from step 3a; generate the dailypay values for *each* trip done for the specific date
# - determine Uber's pay date (http://www.driveuber.sg/getting-paid/); pay period is Mon 4am to following Monday 3:59am
# - update the generated date and amount values into p_uber_trip_payments

# select id, fare, job_period, trip_datetime, pay_period_start, pay_period_end,
#   date_add(job_period, interval 1 day) as advance_date,
#   round(0.9*fare, 2) as advance_amount,
#   if(trip_datetime between pay_period_start and pay_period_end, date(trip_datetime + interval (10 - weekday(trip_datetime)) day), date(trip_datetime + interval (3 - weekday(trip_datetime)) day)) as reserve_date,
#   round(0.1*fare, 2) as reserve_amount
# from p_uber_trip_payments

#todo - script in js - DONE!
update p_uber_trip_payments set
  advance_date = date_add(job_period, interval 1 day),
  advance_amount = round(0.9*fare, 2),
  reserve_date = if(trip_datetime between pay_period_start and pay_period_end, date(trip_datetime + interval (10 - weekday(trip_datetime)) day), date(trip_datetime + interval (3 - weekday(trip_datetime)) day)),
  reserve_amount = round(0.1*fare, 2),
  updated_at = now()
where advance_date = null and
      advance_amount = null and
      reserve_date = null and
      reserve_amount = null and
      job_period = '2016-08-09'


# 20160906
# step 4a. generate the day's total payment, for the service (uber, ... ...)
# - insert the generated data into p_payments

insert into p_payments
  select null as id, user_id, 'uber' as service, job_period,
    sum(fare) as nett_amount,
    advance_date, sum(advance_amount) as advance_amount,
    #reserve_date, sum(reserve_amount) as reserve_amount,
    null as reserve_date,
    #null as reserve_amount,
    sum(reserve_amount) as reserve_amount,
    0 as counter,
    false as processed,
    now() as created_at,
    now() as updated_at
    from proc_computed_uber_trips
    where job_period = '2016-08-09'
  group by user_id, service, job_period
on duplicate key update
  p_payments.counter = p_payments.counter + 1


# 20160929
# step 4b. generate the day's reserve payment, for the service (uber, ... ...)
# - insert the generated data into p_service_reserves

insert into p_reserves
  select null as id, null as payment_id, user_id, 'uber' as service, job_period,
    reserve_date,
    sum(reserve_amount) as reserve_amount,
    0 as counter,
    now() as created_at,
    now() as updated_at
    from p_uber_trip_payments
    where job_period = '2016-08-09'
  group by user_id, service, job_period, reserve_date
on duplicate key update
  p_reserves.counter = p_reserves.counter + 1;

# - update the foreign key 'payment_id' into p_reserves
update p_payments, p_reserves set
  p_reserves.p_payment_id = p_payments.id
  #select * from p_payments, p_reserves
where p_payments.user_id = p_reserves.user_id and
      p_payments.job_period = p_reserves.job_period and
      p_reserves.payment_id is null and
      p_payments.job_period = '2016-08-17'


# 20160924
# step 5. generate data for the payment header *without* convenience fee and nett amount
# - insert the generated data into payments

insert into payments
  select null as id,
    user_id,
    substr(uuid(), 1, 8) as uuid,
    job_period,
    nett_amount,
    advance_date,
    advance_amount,
    null as reserve_date,
    reserve_amount,
    null as rollover_period,
    null as rollover_amount,
    null as fee_amount,
    null as payment_amount,
    false as paid,
    false as rollover,
    now() as created_at,
    now() as updated_at
    from p_payments


# 20160912
# step 6. generate the day's total reserve amount (for all services)
# - insert the generated data into reserves

insert into reserves
  select null as id, null as payment_id, user_id,
    job_period, reserve_date, reserve_amount,
    false as locked, false as paid, 0 as counter,
    now() as created_at, now() as updated_at
    from p_reserves
  #where job_period = '2016-08-17'
on duplicate key update
  reserves.counter = reserves.counter + 1

# - update the foreign key 'payment_id' into reserves
update payments, reserves set
  reserves.payment_id = payments.id
  #select * from payments, reserves
where payments.user_id = reserves.user_id and
      payments.job_period = reserves.job_period and
      reserves.payment_id is null and
      payments.job_period = '2016-08-17'



# 20160925
# step 7. generate computed values for the payment
# - check for rollover from previous pay date
# - update the computed values i.e fee, final payment amount into payments

#get rollover
select id, user_id, job_period, nett_amount from payments
where rollover = true and
      paid = false
order by job_period desc limit 1


#  20160930
# step 8. update weekly reserve amounts
#todo - recheck this
insert into weekly_reserves
  select null as id, user_id, reserve_date, sum(reserve_amount) as reserve_amount, false as locked, false as paid,
0 as counter, now() as created_at, now() as updated_at from reserves
group by user_id, reserve_date
order by reserve_date desc