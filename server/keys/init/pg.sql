--
-- PostgreSQL database dump
--

-- Dumped from database version 14.13
-- Dumped by pg_dump version 14.13

-- Started on 2024-11-29 23:16:06 MSK

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
-- TOC entry 2 (class 3079 OID 3595367)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 3442 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 864 (class 1247 OID 3595379)
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
    'mosquito',
    'set',
    'fragment',
    'box',
    'other'
);


--
-- TOC entry 867 (class 1247 OID 3595401)
-- Name: keys_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.keys_type AS (
	obj uuid,
	specimen integer,
	elm integer,
	region integer
);


--
-- TOC entry 870 (class 1247 OID 3595403)
-- Name: phases; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.phases AS ENUM (
    'plan',
    'run',
    'ready'
);


--
-- TOC entry 873 (class 1247 OID 3595411)
-- Name: prod_row; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.prod_row AS (
	characteristic uuid,
	quantity integer
);


--
-- TOC entry 876 (class 1247 OID 3595414)
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
-- TOC entry 879 (class 1247 OID 3595416)
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
    'doc.nom_prices_setup',
    'doc.inventory_cuts',
    'doc.inventory_goods',
    'doc.scaning'
);


--
-- TOC entry 255 (class 1255 OID 3595443)
-- Name: qinfo(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qinfo(code character varying) RETURNS public.qinfo_type
    LANGUAGE plpgsql
    AS $qinfo$
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
$qinfo$;


--
-- TOC entry 256 (class 1255 OID 7732744)
-- Name: register_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $register_change$
    BEGIN
        --
        -- INSERT INTO feed(ref) select ref from keys order by barcode;
        -- для определения типа операции применяется специальная переменная TG_OP.
        --
        IF (TG_OP = 'DELETE') THEN
			INSERT INTO feed(ref) VALUES(OLD.ref);
        ELSE
			INSERT INTO feed(ref) VALUES(NEW.ref);
        END IF;
        RETURN NULL; -- возвращаемое значение для триггера AFTER игнорируется
    END;
$register_change$;


SET default_table_access_method = heap;

--
-- TOC entry 231 (class 1259 OID 7732347)
-- Name: areg_cuttings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areg_cuttings (
    register uuid NOT NULL,
    register_type public.refs NOT NULL,
    row_num bigint NOT NULL,
    period timestamp without time zone,
    sign smallint DEFAULT 1,
    work_center uuid,
    nom uuid,
    characteristic uuid,
    len numeric(8,2) DEFAULT 0,
    width numeric(8,2) DEFAULT 0,
    qty integer DEFAULT 0,
    quantity numeric(15,3) DEFAULT 0,
    amount numeric(15,3) DEFAULT 0
);


--
-- TOC entry 3443 (class 0 OID 0)
-- Dependencies: 231
-- Name: TABLE areg_cuttings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.areg_cuttings IS 'Деловая обрезь';


--
-- TOC entry 225 (class 1259 OID 3595444)
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
    part uuid,
    part_type public.refs,
    calc_order uuid,
    power numeric(15,3) DEFAULT 0
);
COMMENT ON COLUMN public.areg_dates.register IS 'Регистратор';
COMMENT ON COLUMN public.areg_dates.register_type IS 'Тип регистратора';
COMMENT ON COLUMN public.areg_dates.row_num IS 'Номер строки';
COMMENT ON COLUMN public.areg_dates.period IS 'Период';
COMMENT ON COLUMN public.areg_dates.sign IS 'Вид движения приход-расход';
COMMENT ON COLUMN public.areg_dates.phase IS 'Фаза планирования';
COMMENT ON COLUMN public.areg_dates.date IS 'Дата план или факт';
COMMENT ON COLUMN public.areg_dates.shift IS 'Смена';
COMMENT ON COLUMN public.areg_dates.work_center IS 'Рабочий центр';
COMMENT ON COLUMN public.areg_dates.planing_key IS 'Ключ планирования (barcode)';
COMMENT ON COLUMN public.areg_dates.stage IS 'Этап производства';
COMMENT ON COLUMN public.areg_dates.part IS 'Партия';
COMMENT ON COLUMN public.areg_dates.part IS 'Тип партии';
COMMENT ON COLUMN public.areg_dates.calc_order IS 'Расчёт';
COMMENT ON COLUMN public.areg_dates.power IS 'Мощность';


--
-- TOC entry 226 (class 1259 OID 3595450)
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
COMMENT ON COLUMN public.areg_needs.register IS 'Регистратор';
COMMENT ON COLUMN public.areg_needs.register_type IS 'Тип регистратора';
COMMENT ON COLUMN public.areg_needs.row_num IS 'Номер строки';
COMMENT ON COLUMN public.areg_needs.period IS 'Период';
COMMENT ON COLUMN public.areg_needs.nom IS 'Номенклатура';
COMMENT ON COLUMN public.areg_needs.characteristic IS 'Характеристика';
COMMENT ON COLUMN public.areg_needs.stage IS 'Этап производства';
COMMENT ON COLUMN public.areg_needs.planing_key IS 'Ключ планирования';
COMMENT ON COLUMN public.areg_needs.quantity IS 'Количество';


--
-- TOC entry 227 (class 1259 OID 3595455)
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
-- TOC entry 228 (class 1259 OID 3595460)
-- Name: characteristics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characteristics (
    ref uuid NOT NULL,
    calc_order uuid,
    leading_product uuid,
    name character varying(200)
);


--
-- TOC entry 233 (class 1259 OID 7732738)
-- Name: feed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed (
    seq bigint NOT NULL,
    ref uuid NOT NULL
);


--
-- TOC entry 232 (class 1259 OID 7732737)
-- Name: feed_seq_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feed_seq_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3466 (class 0 OID 0)
-- Dependencies: 232
-- Name: feed_seq_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feed_seq_seq OWNED BY public.feed.seq;


--
-- TOC entry 229 (class 1259 OID 3595463)
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
-- TOC entry 230 (class 1259 OID 3595471)
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    param character varying(100) NOT NULL,
    value json NOT NULL
);


--
-- TOC entry 3277 (class 2604 OID 7732741)
-- Name: feed seq; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed ALTER COLUMN seq SET DEFAULT nextval('public.feed_seq_seq'::regclass);


--
-- TOC entry 3286 (class 1259 OID 3595476)
-- Name: address; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX address ON public.keys USING btree (obj, specimen, elm, region);


--
-- TOC entry 3293 (class 2606 OID 7732359)
-- Name: areg_cuttings areg_cuttings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areg_cuttings
    ADD CONSTRAINT areg_cuttings_pkey PRIMARY KEY (register, register_type, row_num);


--
-- TOC entry 3279 (class 2606 OID 3595482)
-- Name: areg_dates areg_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areg_dates
    ADD CONSTRAINT areg_dates_pkey PRIMARY KEY (register, register_type, row_num);


--
-- TOC entry 3281 (class 2606 OID 3595486)
-- Name: areg_needs areg_needs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areg_needs
    ADD CONSTRAINT areg_needs_pkey PRIMARY KEY (register, register_type, row_num);


--
-- Name: phase_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX phase_date ON public.areg_dates USING btree (phase, date) WITH (deduplicate_items='true');

--
-- Name: phase_part; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX phase_part ON public.areg_dates USING btree (phase, part) WITH (deduplicate_items='true');


--
-- Name: characteristics characteristics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristics
    ADD CONSTRAINT characteristics_pkey PRIMARY KEY (ref);


--
-- TOC entry 3295 (class 2606 OID 7732743)
-- Name: feed feed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed
    ADD CONSTRAINT feed_pkey PRIMARY KEY (seq);


--
-- TOC entry 3289 (class 2606 OID 3595490)
-- Name: keys keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.keys
    ADD CONSTRAINT keys_pkey PRIMARY KEY (ref);


--
-- TOC entry 3283 (class 2606 OID 3595492)
-- Name: calc_orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (ref);


--
-- TOC entry 3291 (class 2606 OID 3595494)
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (param);


--
-- TOC entry 3287 (class 1259 OID 3595495)
-- Name: barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX barcode ON public.keys USING btree (barcode);


--
-- TOC entry 3297 (class 2620 OID 7732745)
-- Name: keys register_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER register_change AFTER INSERT OR DELETE OR UPDATE ON public.keys FOR EACH ROW EXECUTE FUNCTION public.register_change();


--
-- TOC entry 3296 (class 2606 OID 3595496)
-- Name: characteristics order; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristics
    ADD CONSTRAINT "order" FOREIGN KEY (calc_order) REFERENCES public.calc_orders(ref) NOT VALID;


-- Completed on 2024-11-29 23:16:06 MSK

--
-- PostgreSQL database dump complete
--

