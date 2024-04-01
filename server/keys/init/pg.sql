--
-- PostgreSQL database dump
--

-- Dumped from database version 14.11
-- Dumped by pg_dump version 14.11

-- Started on 2024-04-01 14:46:32 MSK

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = off;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET escape_string_warning = off;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 2899788)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 3425 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 886 (class 1247 OID 3176553)
-- Name: key_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.key_type AS ENUM (
    'order',
    'product',
    'layer',
    'profile',
    'filling',
    'glass',
    'glunit',
    'layout',
    'other',
    'fragment'
);


--
-- TOC entry 868 (class 1247 OID 6144761)
-- Name: keys_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.keys_type AS (
	obj uuid,
	specimen integer,
	elm integer,
	region integer
);


--
-- TOC entry 898 (class 1247 OID 8299268)
-- Name: phases; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.phases AS ENUM (
    'plan',
    'run',
    'ready'
);


--
-- TOC entry 892 (class 1247 OID 3698031)
-- Name: prod_row; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.prod_row AS (
	characteristic uuid,
	quantity integer
);


--
-- TOC entry 889 (class 1247 OID 3556323)
-- Name: qinfo_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.qinfo_type AS (
	abonent uuid,
	year integer,
	branch uuid,
	barcode bigint,
	ref uuid,
	calc_order uuid,
	characteristic uuid,
	presentation character varying(200),
	specimen integer,
	elm integer,
	region integer,
	type public.key_type,
	leading_product uuid
);


--
-- TOC entry 895 (class 1247 OID 5825217)
-- Name: refs; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.refs AS ENUM (
    'doc.calc_order',
    'doc.planning_event',
    'doc.work_centers_task',
    'doc.work_centers_performance',
    'doc.purchase_order',
    'doc.debit_cash_order',
    'doc.credit_cash_order',
    'doc.credit_card_order',
    'doc.debit_bank_order',
    'doc.credit_bank_order',
    'doc.selling',
    'doc.purchase',
    'doc.nom_prices_setup'
);


--
-- TOC entry 260 (class 1255 OID 3558639)
-- Name: qinfo(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qinfo(code character varying) RETURNS public.qinfo_type
    LANGUAGE plpgsql
    AS $$
declare
	tmp qinfo_type;
	keys_row keys%ROWTYPE;
	cx_row characteristics%ROWTYPE;
	order_row calc_orders%ROWTYPE;
	icode bigint;
	ucode uuid;
begin
  /* ищем запись в keys */
  if(char_length(code) = 13) then
	code = substring(code, 1, 12);
  end if;
  if char_length(code) = 12 then
    icode = code;
	SELECT * INTO keys_row FROM keys WHERE barcode=icode;
  elseif char_length(code) = 36 then
    ucode = code;
    SELECT * INTO keys_row FROM keys WHERE ref=ucode;
  end if;

  /* подклеиваем заказ и прочую инфу */
  if keys_row.type is null then
	RAISE NOTICE 'null';
  elseif keys_row.type = 'order' then
	SELECT * INTO order_row FROM calc_orders WHERE ref=keys_row.obj;
  else
	SELECT * INTO cx_row FROM characteristics WHERE ref=keys_row.obj;
	SELECT * INTO order_row FROM calc_orders WHERE ref=cx_row.calc_order;
  end if;
  tmp.abonent = order_row.abonent;
  tmp.year = order_row.year;
  tmp.branch = order_row.branch;
  tmp.calc_order = order_row.ref;

  tmp.characteristic = cx_row.ref;
  tmp.leading_product = cx_row.leading_product;

  tmp.barcode = keys_row.barcode;
  tmp.ref = keys_row.ref;
  tmp.specimen = keys_row.specimen;
  tmp.elm = keys_row.elm;
  tmp.region = keys_row.region;
  tmp.type = keys_row.type;

  if keys_row.type = 'order' then
  	tmp.presentation = format('%s от %s', order_row.number_doc, order_row.date);
  else
  	tmp.presentation = cx_row.name;
  end if;
  return tmp;
end
$$;


SET default_table_access_method = heap;

--
-- TOC entry 238 (class 1259 OID 8498928)
-- Name: areg_dates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areg_dates (
    register uuid NOT NULL,
    register_type public.refs NOT NULL,
    row_num bigint NOT NULL,
    period timestamp without time zone NOT NULL,
    sign smallint DEFAULT 1 NOT NULL,
    phase public.phases DEFAULT 'plan'::public.phases NOT NULL,
    date date,
    shift uuid,
    work_center uuid,
    planing_key bigint,
    stage uuid,
    calc_order uuid,
    power numeric(15,3) DEFAULT 0
);


--
-- TOC entry 3426 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN areg_dates.register; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_dates.register IS 'Регистратор';


--
-- TOC entry 3427 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN areg_dates.register_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_dates.register_type IS 'Тип регистратора';


--
-- TOC entry 3428 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN areg_dates.row_num; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_dates.row_num IS 'Номер строки';


--
-- TOC entry 3429 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN areg_dates.period; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_dates.period IS 'Период';


--
-- TOC entry 3430 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN areg_dates.sign; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_dates.sign IS 'Вид движения приход-расход';


--
-- TOC entry 3431 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN areg_dates.phase; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_dates.phase IS 'Фаза планирования';


--
-- TOC entry 3432 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN areg_dates.date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_dates.date IS 'Дата план или факт';


--
-- TOC entry 3433 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN areg_dates.shift; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_dates.shift IS 'Смена';


--
-- TOC entry 3434 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN areg_dates.work_center; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_dates.work_center IS 'Рабочий центр';


--
-- TOC entry 3435 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN areg_dates.planing_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_dates.planing_key IS 'Ключ планирования (barcode)';


--
-- TOC entry 3436 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN areg_dates.stage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_dates.stage IS 'Этап производства';


--
-- TOC entry 3437 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN areg_dates.calc_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_dates.calc_order IS 'Расчёт';


--
-- TOC entry 3438 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN areg_dates.power; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_dates.power IS 'Мощность';


--
-- TOC entry 237 (class 1259 OID 6296209)
-- Name: areg_needs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areg_needs (
    register uuid NOT NULL,
    register_type public.refs NOT NULL,
    row_num bigint NOT NULL,
    period timestamp without time zone,
    sign smallint DEFAULT 1,
    calc_order uuid,
    nom uuid,
    characteristic uuid,
    stage uuid,
    planing_key uuid,
    quantity numeric(15,3) DEFAULT 0
);


--
-- TOC entry 3439 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN areg_needs.register; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_needs.register IS 'Регистратор';


--
-- TOC entry 3440 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN areg_needs.register_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_needs.register_type IS 'Тип регистратора';


--
-- TOC entry 3441 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN areg_needs.row_num; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_needs.row_num IS 'Номер строки';


--
-- TOC entry 3442 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN areg_needs.period; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_needs.period IS 'Период';


--
-- TOC entry 3443 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN areg_needs.nom; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_needs.nom IS 'Номенклатура';


--
-- TOC entry 3444 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN areg_needs.characteristic; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_needs.characteristic IS 'Характеристика';


--
-- TOC entry 3445 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN areg_needs.stage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_needs.stage IS 'Этап производства';


--
-- TOC entry 3446 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN areg_needs.planing_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_needs.planing_key IS 'Ключ планирования';


--
-- TOC entry 3447 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN areg_needs.quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areg_needs.quantity IS 'Количество';


--
-- TOC entry 233 (class 1259 OID 3061481)
-- Name: calc_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calc_orders (
    ref uuid NOT NULL,
    abonent uuid,
    branch uuid,
    year integer,
    date timestamp without time zone,
    number_doc character(11),
    partner uuid,
    organization uuid,
    author uuid,
    department uuid,
    production json
);


--
-- TOC entry 231 (class 1259 OID 2900139)
-- Name: characteristics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characteristics (
    ref uuid NOT NULL,
    calc_order uuid,
    leading_product uuid,
    name character varying(200)
);


--
-- TOC entry 230 (class 1259 OID 2899806)
-- Name: keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.keys (
    ref uuid DEFAULT public.uuid_generate_v1mc() NOT NULL,
    obj uuid NOT NULL,
    specimen integer DEFAULT 1,
    elm integer DEFAULT 0,
    region integer DEFAULT 0,
    barcode bigint DEFAULT 0,
    type public.key_type
);


--
-- TOC entry 232 (class 1259 OID 2900714)
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    param character varying(100) NOT NULL,
    value json NOT NULL
);


--
-- TOC entry 3266 (class 1259 OID 3061357)
-- Name: address; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX address ON public.keys USING btree (obj, specimen, elm, region);


--
-- TOC entry 3279 (class 2606 OID 8498937)
-- Name: areg_dates areg_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areg_dates
    ADD CONSTRAINT areg_dates_pkey PRIMARY KEY (register, register_type, row_num);


--
-- TOC entry 3277 (class 2606 OID 6296217)
-- Name: areg_needs areg_needs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areg_needs
    ADD CONSTRAINT areg_needs_pkey PRIMARY KEY (register, register_type, row_num);


--
-- TOC entry 3271 (class 2606 OID 2900143)
-- Name: characteristics characteristics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristics
    ADD CONSTRAINT characteristics_pkey PRIMARY KEY (ref);


--
-- TOC entry 3269 (class 2606 OID 2899811)
-- Name: keys keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.keys
    ADD CONSTRAINT keys_pkey PRIMARY KEY (ref);


--
-- TOC entry 3275 (class 2606 OID 3061485)
-- Name: calc_orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (ref);


--
-- TOC entry 3273 (class 2606 OID 2900720)
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (param);


--
-- TOC entry 3267 (class 1259 OID 3494689)
-- Name: barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX barcode ON public.keys USING btree (barcode);


--
-- TOC entry 3280 (class 2606 OID 3061494)
-- Name: characteristics order; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristics
    ADD CONSTRAINT "order" FOREIGN KEY (calc_order) REFERENCES public.calc_orders(ref) NOT VALID;


-- Completed on 2024-04-01 14:46:32 MSK

--
-- PostgreSQL database dump complete
--

